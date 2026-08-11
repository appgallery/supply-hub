import { AppDataSource } from "../database/data-source";
import { Color } from "../entities/Color";

const colorRepository = AppDataSource.getRepository(Color);

export const createColor = async (body: any) => {
  const { name, hex_code } = body;

  const existing = await colorRepository.findOne({
    where: {
      name,
    },
  });

  if (existing) {
    throw new Error("Color already exists.");
  }

  const color = colorRepository.create({
    name,
    hex_code,
  });

  return await colorRepository.save(color);
};

export const getColors = async () => {
  return await colorRepository.find({
    order: {
      colorId: "DESC",
    },
  });
};

export const getColorById = async (colorId: number) => {
  const color = await colorRepository.findOne({
    where: {
      colorId,
    },
  });

  if (!color) {
    throw new Error("Color not found.");
  }

  return color;
};

export const updateColor = async (
  colorId: number,
  body: any
) => {
  const color = await colorRepository.findOne({
    where: {
      colorId,
    },
  });

  if (!color) {
    throw new Error("Color not found.");
  }

  const duplicate = await colorRepository.findOne({
    where: {
      name: body.name,
    },
  });

  if (duplicate && duplicate.colorId !== colorId) {
    throw new Error("Color already exists.");
  }

  Object.assign(color, body);

  return await colorRepository.save(color);
};

export const deleteColor = async (colorId: number) => {
  const color = await colorRepository.findOne({
    where: {
      colorId,
    },
  });

  if (!color) {
    throw new Error("Color not found.");
  }

  await colorRepository.remove(color);

  return {
    status: true,
    message: "Color deleted successfully.",
  };
};