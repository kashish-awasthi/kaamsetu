import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { HttpError } from './http.js'

export type Role = 'worker' | 'employer'
export interface AuthUser {
  id: number
  role: Role
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, config.jwtSecret, { subject: String(user.id), expiresIn: config.jwtTtl })
}

function readUser(req: Request): AuthUser | undefined {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return undefined
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload
    const role = payload.role
    if (role !== 'worker' && role !== 'employer') return undefined
    return { id: Number(payload.sub), role }
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.')
  }
}

/** Attaches req.user when a valid token is present, without requiring one. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = readUser(req)
  next()
}

/** Requires a logged-in user, optionally with a specific role. */
export function requireAuth(role?: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = readUser(req)
    if (!user) throw new HttpError(401, 'Please log in to continue')
    if (role && user.role !== role) throw new HttpError(403, `This is only available to ${role}s`)
    req.user = user
    next()
  }
}

/** For handlers behind requireAuth: the user is guaranteed to be set. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, 'Please log in to continue')
  return req.user
}
