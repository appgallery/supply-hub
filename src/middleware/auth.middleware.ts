import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: any;
  email: string;
  roleName: string;
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Authorization:", req.headers.authorization);
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    );

    req.user = decoded;
    console.log("Authorization:", req.headers.authorization);
    next();
  } catch (error) {
    console.error("JWT Error:", error);
    return res.status(401).json({
      status: false,
      message: "Invalid Token",
    });
  }
};