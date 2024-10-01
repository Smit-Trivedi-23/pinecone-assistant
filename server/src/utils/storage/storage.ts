// storage.ts

export interface FileDetail {
  documentId: string;
  name: string;
  url: string;
}

export interface StorageService {
  saveFile(file: Express.Multer.File, fileKey: string): Promise<void>;
  constructFileUrl(fileKey: string): string;
  getFilePath(fileKey: string): Promise<string>;
  listFilesInNamespace(namespaceId: string): Promise<FileDetail[]>;
  deleteWorkspaceFiles(namespaceId: string): Promise<void>;
  deleteFileFromWorkspace(
    namespaceId: string,
    documentId: string
  ): Promise<void>;
}

// import { ServerStorage } from "./serverStorage";
// import { SpacesStorage } from "./spacesStorage";

// const useSpaces =
//   process.env.DO_SPACES_ACCESS_KEY_ID &&
//   process.env.DO_SPACES_SECRET_ACCESS_KEY;
// export const storageService: StorageService = useSpaces
//   ? new SpacesStorage()
//   : new ServerStorage();
import { ServerStorage } from "./serverStorage";
import { AWSStorage } from "./awsStorage";

const useAWS =
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_BUCKET_NAME;

export const storageService: StorageService = useAWS
  ? new AWSStorage()
  : new ServerStorage();