import { Request, Response } from 'express';
import { AuthService } from './auth.service';

const authService = new AuthService();

export const register = async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, ...result });
};

export const login = async (req: Request, res: Response) => {
  const result = await authService.login(req.body.email, req.body.password);
  res.json({ success: true, data: result });
};

export const refresh = async (req: Request, res: Response) => {
  const result = await authService.refresh(req.body.refreshToken);
  res.json({ success: true, data: result });
};

export const logout = async (req: Request, res: Response) => {
  const result = await authService.logout(req.body.refreshToken);
  res.json({ success: true, ...result });
};

export const forgotPassword = async (req: Request, res: Response) => {
  const result = await authService.forgotPassword(req.body.email);
  res.json({ success: true, ...result });
};

export const resetPassword = async (req: Request, res: Response) => {
  const result = await authService.resetPassword(req.body.token, req.body.password);
  res.json({ success: true, ...result });
};

export const getMe = async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  res.json({ success: true, data: user });
};
