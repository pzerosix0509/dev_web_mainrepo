export type Variant = {
  kind: 'THUMB' | 'MEDIUM' | 'LARGE' | 'PREVIEW';
  url: string;
  width: number;
  height: number;
  mimeType: string;
  byteSize: number;
};

export type Photo = {
  id: string;
  originalName: string;
  altText: string;
  width: number;
  height: number;
  currentVersion: number;
  createdAt: string;
  variants: Variant[];
  originalUrl: string;
  manifestUrl: string | null;
};

export type UploadResult = { index: number; fileName: string; status: 'accepted' | 'rejected'; photoId?: string; code?: string; message?: string };
