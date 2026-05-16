import { Request, Response } from 'express';
import { generateLetterPdf } from '../../utils/pdfGenerator';
import { BadRequestError } from '../../utils/errors';

export const createLetter = async (req: Request, res: Response) => {
  const { receiverName, receiverDesignation, receiverAddress, subject, content, senderName, senderDesignation } = req.body;
  if (!receiverName || !receiverAddress || !content) {
    throw new BadRequestError('receiverName, receiverAddress and content are required');
  }
  const buffer = await generateLetterPdf({ receiverName, receiverDesignation, receiverAddress, subject, content, senderName, senderDesignation });
  const filename = `letter-${Date.now()}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
};
