import express from 'express';
import { getAuthUrl, getTokens, getDriveClient } from '../utils/googleDriveAuth';
import { processFile, chunkAndEmbedFile } from '../utils/documentProcessor';
import { DocumentModel } from '../models/documentModel';
import { v4 as uuidv4 } from 'uuid';
import { getContext } from '../utils/context';

const router = express.Router();

router.get('/auth', (req, res) => {
  console.log('Auth route hit');
  const authUrl = getAuthUrl();
  console.log('Generated auth URL:', authUrl);
  res.json({ authUrl });
});

router.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (typeof code !== 'string') {
    return res.status(400).send('Invalid authorization code');
  }

  try {
    const tokens = await getTokens(code);
    // Here you would typically save the tokens securely for future use
    // For now, we'll just send them back to the client
    res.json(tokens);
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.status(500).send('Error during authentication');
  }
});

router.get('/files', async (req, res) => {
  const { accessToken } = req.query;
  if (typeof accessToken !== 'string') {
    return res.status(400).send('Access token is required');
  }

  try {
    const drive = getDriveClient(accessToken);
    const response = await drive.files.list({
      pageSize: 10,
      fields: 'nextPageToken, files(id, name, mimeType)',
    });

    const documentModel = new DocumentModel();
    const processedFiles = [];
    const namespaceId = `gdrive-${uuidv4()}`; // Generate a unique namespace ID

    for (const file of response.data.files || []) {
      if (file.id) {
        const fileContent:any = await drive.files.get({
          fileId: file.id,
          alt: 'media',
        }, { responseType: 'arraybuffer' });

        const { documentContent } = await processFile(
          String(file.name),
          Buffer.from(fileContent.data),
          String(file.mimeType)
        );

        const documentId = `gdrive-${file.id}`;
        const documentUrl = `https://drive.google.com/file/d/${file.id}/view`;

        const { document } = await chunkAndEmbedFile(
          documentId,
          documentUrl,
          documentContent
        );

        await documentModel.upsertDocument(document, namespaceId);
        processedFiles.push(file.name);
      } else {
        throw new Error('File ID is missing');
      }
    }

    res.json({
      message: 'Files processed and added to vector database',
      namespaceId,
      processedFiles,
    });
  } catch (error) {
    console.error('Error processing Google Drive files:', error);
    res.status(500).send('Error processing Google Drive files');
  }
});

router.post('/query', async (req, res) => {
  const { query, namespaceId } = req.body;
  if (!query || !namespaceId) {
    return res.status(400).send('Query and namespaceId are required');
  }

  try {
    const context = await getContext(query, namespaceId);
    res.json(context);
  } catch (error) {
    console.error('Error processing query:', error);
    res.status(500).send('Error processing query');
  }
});

export default router;