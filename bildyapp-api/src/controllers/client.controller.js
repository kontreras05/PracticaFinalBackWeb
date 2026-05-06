import { Client } from '../models/Client.js';
import { paginate } from '../services/pagination.service.js';
import { notificationService } from '../services/notification.service.js';
import AppError from '../utils/AppError.js';

export const createClient = async (req, res, next) => {
  try {
    const { name, cif, email, phone, address } = req.body;
    const { _id: userId, company: companyId } = req.user;

    const existing = await Client.findOne({ company: companyId, cif });
    if (existing) {
      return next(AppError.conflict('Ya existe un cliente con ese CIF en tu empresa.'));
    }

    const client = await Client.create({ user: userId, company: companyId, name, cif, email, phone, address });

    notificationService.emit('client:new', {
      id: String(client._id),
      name: client.name,
      companyId: String(companyId),
    });

    res.status(201).json({ status: 'success', data: { client } });
  } catch (error) {
    next(error);
  }
};

export const updateClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    const client = await Client.findOneAndUpdate(
      { _id: id, company: companyId },
      { $set: req.body },
      { new: true }
    );
    if (!client) return next(AppError.notFound('Cliente no encontrado.'));

    res.status(200).json({ status: 'success', data: { client } });
  } catch (error) {
    next(error);
  }
};

export const listClients = async (req, res, next) => {
  try {
    const { page, limit, name, sort } = req.query;
    const companyId = req.user.company;

    const filter = { company: companyId };
    if (name) filter.name = { $regex: name, $options: 'i' };

    const result = await paginate(Client, filter, { page, limit, sort });
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const listArchivedClients = async (req, res, next) => {
  try {
    const companyId = req.user.company;
    const clients = await Client.findDeleted({ company: companyId });
    res.status(200).json({ status: 'success', data: { clients } });
  } catch (error) {
    next(error);
  }
};

export const getClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    const client = await Client.findOne({ _id: id, company: companyId });
    if (!client) return next(AppError.notFound('Cliente no encontrado.'));

    res.status(200).json({ status: 'success', data: { client } });
  } catch (error) {
    next(error);
  }
};

export const deleteClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const soft = req.query.soft !== 'false';
    const companyId = req.user.company;

    const client = await Client.findOne({ _id: id, company: companyId });
    if (!client) return next(AppError.notFound('Cliente no encontrado.'));

    if (soft) {
      client.deleted = true;
      await client.save();
    } else {
      await Client.findByIdAndDelete(id);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const restoreClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    const client = await Client.findOne({ _id: id, company: companyId, deleted: true });
    if (!client) return next(AppError.notFound('Cliente archivado no encontrado.'));

    client.deleted = false;
    await client.save();

    res.status(200).json({ status: 'success', data: { client } });
  } catch (error) {
    next(error);
  }
};
