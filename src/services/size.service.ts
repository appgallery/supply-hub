import { AppDataSource } from "../database/data-source";
import { Size } from "../entities/Size";

const sizeRepository = AppDataSource.getRepository(Size);

export const createSize = async (body: any) => {
  const { name } = body;

  const existing = await sizeRepository.findOne({
    where: {
      name,
    },
  });

  if (existing) {
    throw new Error("Size already exists.");
  }

  const size = sizeRepository.create({
    name,
  });

  return await sizeRepository.save(size);
};

export const getSizes = async () => {
  return await sizeRepository.find({
    order: {
      sizeId: "DESC",
    },
  });
};

export const getSizeById = async (sizeId: number) => {
  const size = await sizeRepository.findOne({
    where: {
      sizeId,
    },
  });

  if (!size) {
    throw new Error("Size not found.");
  }

  return size;
};

export const updateSize = async (
  sizeId: number,
  body: any
) => {
  const size = await sizeRepository.findOne({
    where: {
      sizeId,
    },
  });

  if (!size) {
    throw new Error("Size not found.");
  }

  const duplicate = await sizeRepository.findOne({
    where: {
      name: body.name,
    },
  });

  if (duplicate && duplicate.sizeId !== sizeId) {
    throw new Error("Size already exists.");
  }

  Object.assign(size, body);

  return await sizeRepository.save(size);
};

export const deleteSize = async (sizeId: number) => {
  const size = await sizeRepository.findOne({
    where: {
      sizeId,
    },
  });

  if (!size) {
    throw new Error("Size not found.");
  }

  await sizeRepository.remove(size);

  return {
    status: true,
    message: "Size deleted successfully.",
  };
};