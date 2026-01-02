import jwt, { SignOptions } from 'jsonwebtoken';

// Removemos a dependência do env.API_SECRET global
// O segredo agora deve ser passado como argumento

export const generateToken = (payload: object, secret: string, expiresIn: string | number = '1h') => {
  // Cast expiresIn to any to bypass strict type checking for the options object overload
  // or explicitly construct the object with a compatible type
  const options: SignOptions = { expiresIn: expiresIn as any };
  return jwt.sign(payload, secret, options);
};

export const verifyToken = (token: string, secret: string) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};