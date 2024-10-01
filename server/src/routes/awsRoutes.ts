import express from 'express';
import { AWSStorage } from '../utils/storage/awsStorage';
import { processFile, chunkAndEmbedFile } from '../utils/documentProcessor';
import { DocumentModel } from '../models/documentModel';

const router = express.Router();

// Check if all required environment variables are set
const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_BUCKET_NAME', 'AWS_REGION'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} is not set in the environment variables`);
    process.exit(1);
  }
}

router.get('/aws-files', async (req, res) => {
  try {
    const awsStorage = new AWSStorage();
    const files = await awsStorage.listFilesInNamespace('');
    console.log("All files",files);
    const documentModel = new DocumentModel();
    const processedFiles = [];
    const namespaceId = 's3-test';

    for (const file of files) {
      const fileContent: any = await awsStorage.getFile(file.name, process.env.AWS_BUCKET_NAME || '');
      
      // Convert IncomingMessage to Buffer
     
      
      console.log("File buffer:", fileContent);
      
      const { documentContent } = await processFile(
        file.name,
        fileContent,// Assuming buffer is a string
        'application/octet-stream' // You might want to determine the content type dynamically
      );
      
      const documentId = `s3-${file.name}`;
      const documentUrl = awsStorage.constructFileUrl(file.name);

      const { document } = await chunkAndEmbedFile(
        documentId,
        documentUrl,
        documentContent
      );
      console.log('document', document);

      await documentModel.upsertDocument(document, namespaceId);
      processedFiles.push(file.name);
    }

    res.json({
      message: 'AWS S3 files processed and added to vector database',
      namespaceId,
      processedFiles,
    });
  } catch (error) {
    console.error('Error processing AWS S3 files:', error);
    res.status(500).send('Error processing AWS S3 files');
  }
});

export default router;