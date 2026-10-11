export type TransferFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
};
export type UploadTarget = TransferFile & { path: string; signedUrl: string };
export type InitResponse = {
  transferId: string;
  ownerToken: string;
  uploadDeadline: string;
  serverTime: string;
  targets: UploadTarget[];
};
export type ReadyResponse = {
  code: string;
  shareToken: string;
  expiresAt: string;
  serverTime: string;
};
export type ReceiveResponse = {
  receiveToken: string;
  transferId: string;
  files: TransferFile[];
  totalBytes: number;
  expiresAt: string;
  serverTime: string;
};
export type StatusResponse = {
  status: string;
  uploadDeadline: string;
  expiresAt: string | null;
  serverTime: string;
  files: (TransferFile & { uploaded: boolean })[];
  ready?: ReadyResponse;
};
