import { DeliveryNote } from '../models/DeliveryNote.js';
import { Client } from '../models/Client.js';
import { Project } from '../models/Project.js';
import { paginate } from '../services/pagination.service.js';
import { uploadBuffer } from '../services/storage.service.js';
import { generateDeliveryNotePDF } from '../services/pdf.service.js';
import { notificationService } from '../services/notification.service.js';
import AppError from '../utils/AppError.js';

export const createDeliveryNote = async (req, res, next) => {
  try {
    const { client: clientId, project: projectId, ...rest } = req.body;
    const { _id: userId, company: companyId } = req.user;

    const [client, project] = await Promise.all([
      Client.findOne({ _id: clientId, company: companyId }),
      Project.findOne({ _id: projectId, company: companyId }),
    ]);
    if (!client) return next(AppError.notFound('Cliente no encontrado en tu empresa.'));
    if (!project) return next(AppError.notFound('Proyecto no encontrado en tu empresa.'));

    const note = await DeliveryNote.create({
      user: userId,
      company: companyId,
      client: clientId,
      project: projectId,
      ...rest,
    });

    notificationService.emit('deliverynote:new', {
      id: String(note._id),
      companyId: String(companyId),
    });

    res.status(201).json({ status: 'success', data: { deliveryNote: note } });
  } catch (error) {
    next(error);
  }
};

export const listDeliveryNotes = async (req, res, next) => {
  try {
    const { page, limit, project, client, format, signed, from, to, sort } = req.query;
    const companyId = req.user.company;

    const filter = { company: companyId };
    if (project) filter.project = project;
    if (client) filter.client = client;
    if (format) filter.format = format;
    if (signed !== undefined) filter.signed = signed;
    if (from || to) {
      filter.workDate = {};
      if (from) filter.workDate.$gte = from;
      if (to) filter.workDate.$lte = to;
    }

    const result = await paginate(DeliveryNote, filter, { page, limit, sort });
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const getDeliveryNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    const note = await DeliveryNote.findOne({ _id: id, company: companyId })
      .populate('user', 'name lastName email')
      .populate('client', 'name cif email phone')
      .populate('project', 'name projectCode');

    if (!note) return next(AppError.notFound('Albarán no encontrado.'));

    res.status(200).json({ status: 'success', data: { deliveryNote: note } });
  } catch (error) {
    next(error);
  }
};

export const getDeliveryNotePDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    const note = await DeliveryNote.findOne({ _id: id, company: companyId })
      .populate('user', 'name lastName email')
      .populate('client', 'name cif email phone address')
      .populate('project', 'name projectCode notes')
      .populate('company', 'name cif address logo');

    if (!note) return next(AppError.notFound('Albarán no encontrado.'));

    if (note.pdfUrl) {
      return res.redirect(note.pdfUrl);
    }

    const pdfBuffer = await generateDeliveryNotePDF(note);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="albaran-${note._id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

export const signDeliveryNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    if (!req.file) return next(AppError.badRequest('Se requiere una imagen de firma.'));

    const note = await DeliveryNote.findOne({ _id: id, company: companyId })
      .populate('user', 'name lastName email')
      .populate('client', 'name cif email phone address')
      .populate('project', 'name projectCode notes')
      .populate('company', 'name cif address logo');

    if (!note) return next(AppError.notFound('Albarán no encontrado.'));
    if (note.signed) return next(AppError.conflict('El albarán ya está firmado.'));

    // Upload signature image (Sharp optimization handled inside storage.service)
    const signaturePublicId = `signatures/${String(companyId)}/${id}`;
    const signatureUrl = await uploadBuffer(req.file.buffer, signaturePublicId, req.file.mimetype);

    // Prepare all fields before save (single save to avoid pre-hook block)
    note.signatureUrl = signatureUrl;
    note.signed = true;
    note.signedAt = new Date();

    // Generate PDF with populated data and signature already set in memory
    const pdfBuffer = await generateDeliveryNotePDF(note);
    const pdfPublicId = `pdfs/${String(companyId)}/${id}`;
    const pdfUrl = await uploadBuffer(pdfBuffer, pdfPublicId, 'application/pdf');

    note.pdfUrl = pdfUrl;
    await note.save();

    notificationService.emit('deliverynote:signed', {
      id: String(note._id),
      companyId: String(companyId),
      pdfUrl,
    });

    res.status(200).json({ status: 'success', data: { deliveryNote: note } });
  } catch (error) {
    next(error);
  }
};

export const deleteDeliveryNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const soft = req.query.soft !== 'false';
    const companyId = req.user.company;

    const note = await DeliveryNote.findOne({ _id: id, company: companyId });
    if (!note) return next(AppError.notFound('Albarán no encontrado.'));
    if (note.signed) return next(AppError.conflict('No se puede eliminar un albarán firmado.'));

    if (soft) {
      note.deleted = true;
      await note.save();
    } else {
      await DeliveryNote.findByIdAndDelete(id);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
