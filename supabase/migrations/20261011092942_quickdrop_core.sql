-- QuickDrop only. Storage objects MUST be managed with the Storage API, never SQL.
create table public.usage_guard (
  id boolean primary key default true check (id),
  reserved_bytes bigint not null default 0 check (reserved_bytes between 0 and 750000000),
  estimated_egress_bytes bigint not null default 0 check (estimated_egress_bytes >= 0),
  period_start timestamptz, cleanup_heartbeat timestamptz,
  init_enabled boolean not null default true, lookup_enabled boolean not null default true
);
insert into public.usage_guard(id) values(true);
create table public.transfers (
  id uuid primary key,
  status text not null default 'uploading' check(status in ('uploading','ready','revoked','deleting','cleanup_failed')),
  owner_token_digest text not null unique, share_token_digest text not null unique, code_digest text unique,
  idempotency_key_digest text not null unique,
  created_at timestamptz not null default now(), upload_deadline timestamptz not null default now()+interval '15 minutes',
  upload_credentials_valid_until timestamptz not null default now()+interval '122 minutes',
  purge_after timestamptz not null default now()+interval '132 minutes',
  ready_at timestamptz, expires_at timestamptz,
  reserved_bytes bigint not null check(reserved_bytes between 25000000 and 125000000),
  actual_total_bytes bigint check(actual_total_bytes between 1 and 50000000),
  file_count integer not null check(file_count between 1 and 5),
  cleanup_attempts integer not null default 0, cleanup_next_attempt_at timestamptz,
  last_cleanup_error_code text, cleanup_lease_until timestamptz, cleanup_lease_id uuid
);
create index transfers_cleanup on public.transfers(status, cleanup_next_attempt_at, upload_deadline, expires_at);
create table public.transfer_files (
  id uuid primary key, transfer_id uuid not null references public.transfers(id) on delete cascade,
  object_path text not null unique,
  original_name text not null check(length(original_name) between 1 and 180), declared_mime text not null,
  declared_size_bytes bigint not null check(declared_size_bytes between 1 and 25000000),
  actual_size_bytes bigint check(actual_size_bytes between 1 and 25000000),
  upload_status text not null default 'pending' check(upload_status in ('pending','uploaded')),
  download_grants_count integer not null default 0 check(download_grants_count between 0 and 10),
  created_at timestamptz not null default now(), uploaded_at timestamptz, deleted_at timestamptz,
  check(object_path = transfer_id::text || '/' || id::text)
);
create index transfer_files_transfer on public.transfer_files(transfer_id);
create table public.receive_sessions (
  token_digest text primary key, transfer_id uuid not null references public.transfers(id) on delete cascade,
  created_at timestamptz not null default now(), expires_at timestamptz not null
);
create index receive_sessions_expiry on public.receive_sessions(expires_at);
create table public.idempotency_records (
  scope text not null, key_digest text not null, request_digest text not null,
  transfer_id uuid not null references public.transfers(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','issued')),
  encrypted_response text, created_at timestamptz not null default now(), expires_at timestamptz not null,
  primary key(scope,key_digest)
);
create table public.download_grants (
  id uuid primary key, transfer_file_id uuid not null references public.transfer_files(id) on delete cascade,
  receive_session_digest text not null references public.receive_sessions(token_digest) on delete cascade,
  idempotency_key_digest text not null,
  status text not null default 'pending' check(status in ('pending','issued','failed')),
  encrypted_url text, valid_until timestamptz not null, lease_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique(transfer_file_id, receive_session_digest, idempotency_key_digest)
);
create table public.rate_limit_buckets (
  scope text not null, identifier_digest text not null, window_start timestamptz not null,
  attempts integer not null check(attempts > 0), expires_at timestamptz not null,
  primary key(scope,identifier_digest,window_start)
);

create function public.qd_rate_limit(p_scope text, p_identifier text, p_limit integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_window timestamptz; v_count integer;
begin
  if p_limit < 1 or p_limit > 10000 then raise exception 'QD_INPUT'; end if;
  v_window := to_timestamp(floor(extract(epoch from now())/600)*600);
  insert into rate_limit_buckets(scope,identifier_digest,window_start,attempts,expires_at)
  values(p_scope,p_identifier,v_window,1,v_window+interval '24 hours')
  on conflict(scope,identifier_digest,window_start) do update set attempts=least(rate_limit_buckets.attempts+1,100000)
  returning attempts into v_count;
  return jsonb_build_object('allowed',v_count<=p_limit,'retryAfterSeconds',greatest(1,ceil(extract(epoch from v_window+interval '10 minutes'-now()))));
end $$;

create function public.qd_init(p_id uuid,p_owner text,p_share text,p_key text,p_request text,p_files jsonb,p_period timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare g usage_guard; t transfers; r idempotency_records; f jsonb; n integer; total_bytes bigint; reserve bigint;
begin
  -- One lock serializes quota and init idempotency across all serverless instances.
  select * into g from usage_guard where id=true for update;
  select * into r from idempotency_records where scope='init' and key_digest=p_key;
  if found then
    if r.request_digest<>p_request then raise exception 'QD_IDEMPOTENCY'; end if;
    select * into t from transfers where id=r.transfer_id;
    if t.status<>'uploading' or t.upload_deadline<=now() then raise exception 'QD_UNAVAILABLE'; end if;
    if r.status<>'issued' then raise exception 'QD_PENDING'; end if;
    return jsonb_build_object('created',false,'encryptedResponse',r.encrypted_response);
  end if;
  if not g.init_enabled or g.cleanup_heartbeat is null or g.cleanup_heartbeat<now()-interval '10 minutes' then raise exception 'QD_CLEANUP_STALE'; end if;
  if p_period is null or p_period>now() or (g.period_start is not null and p_period<g.period_start) then raise exception 'QD_PERIOD'; end if;
  if g.period_start is null or p_period>g.period_start then
    update usage_guard set period_start=p_period,estimated_egress_bytes=0 where id=true;
    g.estimated_egress_bytes:=0;
  end if;
  if g.estimated_egress_bytes>=4000000000 then raise exception 'QD_CAPACITY'; end if;
  n:=jsonb_array_length(p_files);
  select sum((value->>'size')::bigint) into total_bytes from jsonb_array_elements(p_files);
  if n not between 1 and 5 or total_bytes not between 1 and 50000000 then raise exception 'QD_INPUT'; end if;
  reserve:=n*25000000::bigint;
  if g.reserved_bytes+reserve>750000000 then raise exception 'QD_CAPACITY'; end if;
  insert into transfers(id,owner_token_digest,share_token_digest,idempotency_key_digest,file_count,reserved_bytes)
  values(p_id,p_owner,p_share,p_key,n,reserve) returning * into t;
  for f in select value from jsonb_array_elements(p_files) loop
    insert into transfer_files(id,transfer_id,object_path,original_name,declared_mime,declared_size_bytes)
    values((f->>'id')::uuid,p_id,p_id::text||'/'||(f->>'id'),f->>'name',f->>'mime',(f->>'size')::bigint);
  end loop;
  insert into idempotency_records(scope,key_digest,request_digest,transfer_id,expires_at)
  values('init',p_key,p_request,p_id,t.purge_after);
  update usage_guard set reserved_bytes=reserved_bytes+reserve where id=true;
  return jsonb_build_object('created',true,'transfer',to_jsonb(t));
end $$;

create function public.qd_init_commit(p_id uuid,p_key text,p_response text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from transfers where id=p_id and status='uploading' and now()<created_at+interval '2 minutes' for update;
  if not found then raise exception 'QD_UNAVAILABLE'; end if;
  update idempotency_records set status='issued',encrypted_response=p_response
  where scope='init' and key_digest=p_key and transfer_id=p_id and status='pending';
  if not found then raise exception 'QD_IDEMPOTENCY'; end if;
end $$;

create function public.qd_owner(p_id uuid,p_owner text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t transfers;
begin
  select * into t from transfers where id=p_id and owner_token_digest=p_owner;
  if not found then raise exception 'QD_AUTH'; end if;
  return jsonb_build_object('transfer',to_jsonb(t),'files',coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at,f.id) from transfer_files f where transfer_id=t.id),'[]'::jsonb),'serverTime',now());
end $$;

create function public.qd_complete(p_id uuid,p_owner text,p_key text,p_request text,p_code text,p_response text,p_actual jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t transfers; r idempotency_records; f transfer_files; n integer; total_bytes bigint:=0;
begin
  select * into t from transfers where id=p_id and owner_token_digest=p_owner for update;
  if not found then raise exception 'QD_AUTH'; end if;
  if t.status='ready' and t.expires_at>now() then
    select * into r from idempotency_records where scope='complete:'||p_id::text;
    if r.key_digest=p_key and r.request_digest<>p_request then raise exception 'QD_IDEMPOTENCY'; end if;
    return jsonb_build_object('encryptedResponse',r.encrypted_response,'expiresAt',t.expires_at,'serverTime',now());
  end if;
  if t.status<>'uploading' or t.upload_deadline<=now() then raise exception 'QD_UNAVAILABLE'; end if;
  n:=jsonb_array_length(p_actual);
  if n<>t.file_count then raise exception 'QD_MISMATCH'; end if;
  for f in select * from transfer_files where transfer_id=p_id loop
    if not exists(select 1 from jsonb_array_elements(p_actual) a where a->>'id'=f.id::text and (a->>'size')::bigint=f.declared_size_bytes) then raise exception 'QD_MISMATCH'; end if;
    total_bytes:=total_bytes+f.declared_size_bytes;
    update transfer_files set actual_size_bytes=declared_size_bytes,upload_status='uploaded',uploaded_at=now() where id=f.id;
  end loop;
  if total_bytes>50000000 then raise exception 'QD_MISMATCH'; end if;
  update transfers set status='ready',ready_at=now(),expires_at=now()+interval '30 minutes',actual_total_bytes=total_bytes,code_digest=p_code where id=p_id returning * into t;
  insert into idempotency_records(scope,key_digest,request_digest,transfer_id,status,encrypted_response,expires_at)
  values('complete:'||p_id::text,p_key,p_request,p_id,'issued',p_response,t.purge_after);
  return jsonb_build_object('encryptedResponse',p_response,'expiresAt',t.expires_at,'serverTime',now());
end $$;

create function public.qd_receive(p_kind text,p_digest text,p_session text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t transfers;
begin
  if not (select lookup_enabled from usage_guard where id=true) then raise exception 'QD_LOOKUP_DISABLED'; end if;
  select * into t from transfers where
    ((p_kind='code' and code_digest=p_digest) or (p_kind='share' and share_token_digest=p_digest))
    and status='ready' and expires_at>now() for share;
  if not found then raise exception 'QD_UNAVAILABLE'; end if;
  insert into receive_sessions(token_digest,transfer_id,expires_at) values(p_session,t.id,t.expires_at);
  return jsonb_build_object('transferId',t.id,'expiresAt',t.expires_at,'serverTime',now(),'totalBytes',t.actual_total_bytes,
    'files',(select jsonb_agg(jsonb_build_object('id',id,'name',original_name,'size',actual_size_bytes,'mime',declared_mime) order by created_at,id) from transfer_files where transfer_id=t.id));
end $$;

create function public.qd_grant_begin(p_file uuid,p_session text,p_key text,p_grant uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t transfers; f transfer_files; s receive_sessions; d download_grants; ttl integer;
begin
  perform 1 from usage_guard where id=true for update;
  select * into s from receive_sessions where token_digest=p_session and expires_at>now();
  if not found then raise exception 'QD_AUTH'; end if;
  select * into t from transfers where id=s.transfer_id and status='ready' and expires_at>now() for update;
  if not found then raise exception 'QD_UNAVAILABLE'; end if;
  select * into f from transfer_files where id=p_file and transfer_id=t.id for update;
  if not found then raise exception 'QD_UNAVAILABLE'; end if;
  select * into d from download_grants where transfer_file_id=p_file and receive_session_digest=p_session and idempotency_key_digest=p_key;
  if found then
    if d.status='issued' and d.valid_until>now() then return jsonb_build_object('replay',true,'encryptedUrl',d.encrypted_url,'validUntil',d.valid_until); end if;
    if d.status='pending' and d.lease_until>now() then raise exception 'QD_PENDING'; end if;
    raise exception 'QD_GRANT_EXPIRED';
  end if;
  ttl:=floor(least(60,extract(epoch from t.expires_at-now())-1));
  if ttl<1 then raise exception 'QD_UNAVAILABLE'; end if;
  if f.download_grants_count>=10 then raise exception 'QD_GRANT_LIMIT'; end if;
  insert into download_grants(id,transfer_file_id,receive_session_digest,idempotency_key_digest,valid_until,lease_until)
  values(p_grant,p_file,p_session,p_key,now()+make_interval(secs=>ttl),now()+interval '2 minutes') returning * into d;
  update transfer_files set download_grants_count=download_grants_count+1 where id=p_file;
  update usage_guard set estimated_egress_bytes=estimated_egress_bytes+f.actual_size_bytes where id=true;
  return jsonb_build_object('replay',false,'id',d.id,'path',f.object_path,'name',f.original_name,'ttl',ttl,'validUntil',d.valid_until);
end $$;

create function public.qd_grant_commit(p_grant uuid,p_url text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from transfers t join transfer_files f on f.transfer_id=t.id
    join download_grants d on d.transfer_file_id=f.id
    where d.id=p_grant and t.status='ready' and t.expires_at>now() for update of t;
  if not found then raise exception 'QD_UNAVAILABLE'; end if;
  -- Pending/uncertain grants retain their counter forever until transfer cleanup.
  -- No unsafe refund after signing; expiry cannot produce an eleventh authorization.
  update download_grants set status='issued',encrypted_url=p_url where id=p_grant and status='pending' and valid_until>now();
  if not found then raise exception 'QD_GRANT_EXPIRED'; end if;
end $$;

create function public.qd_revoke(p_id uuid,p_owner text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from transfers where id=p_id and owner_token_digest=p_owner for update;
  if not found then raise exception 'QD_AUTH'; end if;
  update transfers set status='revoked',cleanup_next_attempt_at=now() where id=p_id and status in ('uploading','ready');
end $$;

create function public.qd_cleanup_claim(p_lease uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  -- The lease prevents overlap. A crashed worker can be retried after 2 minutes.
  with candidates as (
    select id from transfers where
      ((status='uploading' and upload_deadline<=now()) or (status='ready' and expires_at<=now()) or status in ('revoked','deleting','cleanup_failed'))
      and (cleanup_next_attempt_at is null or cleanup_next_attempt_at<=now())
      and (cleanup_lease_until is null or cleanup_lease_until<=now())
      order by created_at for update skip locked limit 50
  ), claimed as (
    update transfers t set status='deleting',cleanup_lease_id=p_lease,cleanup_lease_until=now()+interval '2 minutes',cleanup_attempts=cleanup_attempts+1
    from candidates c where t.id=c.id returning t.*
  ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'purgeAfter',c.purge_after,
    'paths',(select jsonb_agg(object_path) from transfer_files where transfer_id=c.id))),'[]'::jsonb) into result from claimed c;
  return result;
end $$;

create function public.qd_cleanup_finish(p_id uuid,p_lease uuid,p_success boolean,p_error text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare t transfers;
begin
  perform 1 from usage_guard where id=true for update;
  select * into t from transfers where id=p_id and cleanup_lease_id=p_lease and cleanup_lease_until>now() for update;
  if not found then return; end if;
  if p_success and now()>=t.purge_after then
    update usage_guard set reserved_bytes=reserved_bytes-t.reserved_bytes where id=true;
    delete from transfers where id=p_id;
  elsif p_success then
    update transfer_files set deleted_at=now() where transfer_id=p_id;
    update transfers set cleanup_lease_id=null,cleanup_lease_until=null,cleanup_next_attempt_at=now()+interval '5 minutes',last_cleanup_error_code=null where id=p_id;
  else
    update transfers set status='cleanup_failed',cleanup_lease_id=null,cleanup_lease_until=null,
      cleanup_next_attempt_at=now()+make_interval(secs=>least(1800,30*power(2,least(t.cleanup_attempts,6))::integer)),
      last_cleanup_error_code=left(coalesce(p_error,'STORAGE_DELETE_FAILED'),64) where id=p_id;
  end if;
end $$;

create function public.qd_cleanup_heartbeat()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Only mark a healthy sweep when due work is clear, or awaiting a future tombstone sweep.
  if exists(select 1 from transfers where status='cleanup_failed') then return; end if;
  if exists(select 1 from transfers where
    ((status='uploading' and upload_deadline<now()-interval '10 minutes') or (status='ready' and expires_at<now()-interval '10 minutes')
      or (status in ('deleting','revoked') and coalesce(cleanup_next_attempt_at,created_at)<now()-interval '10 minutes'))) then return; end if;
  update usage_guard set cleanup_heartbeat=now() where id=true;
  delete from rate_limit_buckets where expires_at<now();
  -- Grant counters remain until final cleanup. Sessions/grants cascade with transfer.
end $$;

-- No anonymous/authenticated access, including function calls.
do $$ declare tbl text; fn record; begin
  foreach tbl in array array['usage_guard','transfers','transfer_files','receive_sessions','idempotency_records','download_grants','rate_limit_buckets'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from public,anon,authenticated',tbl);
    execute format('grant all on public.%I to service_role',tbl);
  end loop;
  for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'qd\_%' escape '\' loop
    execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
    execute format('grant execute on function %s to service_role',fn.signature);
  end loop;
end $$;
