import { S3 } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import { FileDetail, StorageService } from "./storage";

const s3 = new S3({
  region: process.env.AWS_REGION || 'eu-north-1', // Provide a default region if not set
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export class AWSStorage implements StorageService {
  async getFile(key: string, bucket: string): Promise<Buffer> {
    const params = {
      Bucket: bucket,
      Key: key,
    };

    try {
      const data:any = await s3.getObject(params);
      const chunks: Buffer[] = [];
      for await (const chunk of data.Body) {
        chunks.push(chunk);
      }
      const buffer: any = Buffer.concat(chunks);
      console.log("buffer only", buffer, data)
      return buffer;
    } catch (error) {
      console.error('Error getting file from S3:', error);
      throw error;
    }
  }

  async saveFile(file: Express.Multer.File, fileKey: string): Promise<void> {
    const fileStream = fs.createReadStream(file.path);

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
      Body: fileStream,
      ContentType: file.mimetype,
    };

    try {
      await new Upload({
        client: s3,
        params,
      }).done();
    } catch (error) {
      console.error("Failed to upload file to S3:", error);
      throw error;
    } finally {
      try {
        await fs.promises.unlink(file.path);
      } catch (error) {
        console.error("Failed to delete local file:", error);
      }
    }
  }

  async deleteFileFromWorkspace(
    namespaceId: string,
    documentId: string
  ): Promise<void> {
    const filePrefix = `${namespaceId}/${documentId}/`;
    const listParams = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Prefix: filePrefix,
    };
    const listedObjects = await s3.listObjectsV2(listParams);
    if (listedObjects.Contents) {
      const objectsToDelete = listedObjects.Contents
        .filter((content): content is { Key: string } => content.Key !== undefined)
        .map((content) => ({ Key: content.Key }));

      if (objectsToDelete.length > 0) {
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET_NAME!,
          Delete: { Objects: objectsToDelete },
        };
        await s3.deleteObjects(deleteParams);
      }
    }
  }

  async getFilePath(fileKey: string): Promise<string> {
    throw new Error("Not applicable for S3 storage");
  }

  constructFileUrl(fileKey: string): string {
    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
  }

  async deleteWorkspaceFiles(namespaceId: string): Promise<void> {
    const filePrefix = `${namespaceId}/`;
    const listParams = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Prefix: filePrefix,
    };
    const listedObjects = await s3.listObjectsV2(listParams);
    if (listedObjects.Contents) {
      const objectsToDelete = listedObjects.Contents
        .filter((content): content is { Key: string } => content.Key !== undefined)
        .map((content) => ({ Key: content.Key }));

      if (objectsToDelete.length > 0) {
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET_NAME!,
          Delete: { Objects: objectsToDelete },
        };

        const maxRetries = 3;
        let retries = 0;
        while (retries < maxRetries) {
          try {
            await s3.deleteObjects(deleteParams);
            return;
          } catch (error) {
            console.error(
              `Failed to delete objects (attempt ${retries + 1}):`,
              error
            );
            retries++;
          }
        }

        throw new Error(
          `Failed to delete objects after ${maxRetries} attempts`
        );
      }
    }
  }

  async listFilesInNamespace(namespaceId: string): Promise<FileDetail[]> {
    const bucket = process.env.AWS_BUCKET_NAME || '';
    const prefix = `${namespaceId}/`;
    console.log(`Listing files in namespace: ${namespaceId}, bucket: ${bucket}, prefix: ${prefix}`);
    return this.listFilesRecursive(prefix, bucket);
  }

  private async listFilesRecursive(
    currentPrefix: string,
    bucket: string
  ): Promise<FileDetail[]> {
    const params = {
      Bucket: bucket,
    //   Prefix: currentPrefix,
    //   Delimiter: "/",
    };

    try {
      console.log(`Listing objects with params:`, params);
      const data = await s3.listObjectsV2(params);
      console.log(`S3 listObjectsV2 response:`, JSON.stringify(data, null, 2));

      let files = (data.Contents ?? [])
        .filter((item): item is { Key: string } => item.Key !== undefined)
        .map((item) => ({
          documentId: item.Key.split("/")[1],
          name: item.Key.replace(currentPrefix, ""),
          url: this.constructFileUrl(item.Key),
        }));

      console.log(`Processed files:`, files);

      if (data.CommonPrefixes && data.CommonPrefixes.length > 0) {
        console.log(`Found CommonPrefixes:`, data.CommonPrefixes);
        const recursiveFiles = await Promise.all(
          data.CommonPrefixes
            .filter((cp): cp is { Prefix: string } => cp.Prefix !== undefined)
            .map((cp) => this.listFilesRecursive(cp.Prefix, bucket))
        );
        files = files.concat(recursiveFiles.flat());
      }

      return files;
    } catch (error) {
      console.error("Failed to list files from S3:", error);
      throw error;
    }
  }
}