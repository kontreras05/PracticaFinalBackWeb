import { Project } from '../models/Project.js';
import { Client } from '../models/Client.js';
import { paginate } from '../services/pagination.service.js';
import { notificationService } from '../services/notification.service.js';
import AppError from '../utils/AppError.js';

export const createProject = async (req, res, next) => {
  try {
    const { name, projectCode, client: clientId, address, email, notes, active } = req.body;
    const { _id: userId, company: companyId } = req.user;

    const client = await Client.findOne({ _id: clientId, company: companyId });
    if (!client) return next(AppError.notFound('Cliente no encontrado en tu empresa.'));

    const existing = await Project.findOne({ company: companyId, projectCode });
    if (existing) {
      return next(AppError.conflict('Ya existe un proyecto con ese código en tu empresa.'));
    }

    const project = await Project.create({
      user: userId,
      company: companyId,
      client: clientId,
      name,
      projectCode,
      address,
      email,
      notes,
      active,
    });

    notificationService.emit('project:new', {
      id: String(project._id),
      name: project.name,
      companyId: String(companyId),
    });

    res.status(201).json({ status: 'success', data: { project } });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    if (req.body.client) {
      const client = await Client.findOne({ _id: req.body.client, company: companyId });
      if (!client) return next(AppError.notFound('Cliente no encontrado en tu empresa.'));
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, company: companyId },
      { $set: req.body },
      { new: true }
    );
    if (!project) return next(AppError.notFound('Proyecto no encontrado.'));

    res.status(200).json({ status: 'success', data: { project } });
  } catch (error) {
    next(error);
  }
};

export const listProjects = async (req, res, next) => {
  try {
    const { page, limit, client, name, active, sort } = req.query;
    const companyId = req.user.company;

    const filter = { company: companyId };
    if (client) filter.client = client;
    if (name) filter.name = { $regex: name, $options: 'i' };
    if (active !== undefined) filter.active = active;

    const result = await paginate(Project, filter, { page, limit, sort });
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const listArchivedProjects = async (req, res, next) => {
  try {
    const companyId = req.user.company;
    const projects = await Project.findDeleted({ company: companyId });
    res.status(200).json({ status: 'success', data: { projects } });
  } catch (error) {
    next(error);
  }
};

export const getProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    const project = await Project.findOne({ _id: id, company: companyId }).populate('client', 'name cif email');
    if (!project) return next(AppError.notFound('Proyecto no encontrado.'));

    res.status(200).json({ status: 'success', data: { project } });
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const soft = req.query.soft !== 'false';
    const companyId = req.user.company;

    const project = await Project.findOne({ _id: id, company: companyId });
    if (!project) return next(AppError.notFound('Proyecto no encontrado.'));

    if (soft) {
      project.deleted = true;
      await project.save();
    } else {
      await Project.findByIdAndDelete(id);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const restoreProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    const project = await Project.findOne({ _id: id, company: companyId, deleted: true });
    if (!project) return next(AppError.notFound('Proyecto archivado no encontrado.'));

    project.deleted = false;
    await project.save();

    res.status(200).json({ status: 'success', data: { project } });
  } catch (error) {
    next(error);
  }
};
