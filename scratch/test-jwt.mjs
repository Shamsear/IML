process.env.NEXTAUTH_SECRET = "super-secret-admin-key-change-this-in-prod-12345";

import { verifyBrandJWT } from '../lib/jwt.js';

const secrets = [
  'eyJhbGciOiJIUzI1NiJ9.eyJiIjoiQlJORC0wMDEifQ.59GWE5WGR4owX3-CplGDUTpxcqPHGHfBLUZft_ujDZc',
  'eyJhbGciOiJIUzI1NiJ9.eyJiIjoiQlJORC0wMDIifQ.FBH5G4qR5Wa_GNtR_X6Yvt05BurTdMjl0yv89SmT8yg',
  'eyJhbGciOiJIUzI1NiJ9.eyJiIjoiQlJORC0wMDMifQ.-VqkDYBGdcpJJoNol5TFjxNKXem7JvvWmwHoKOep-Nc'
];

secrets.forEach((s, idx) => {
  const payload = verifyBrandJWT(s);
  console.log(`Token ${idx + 1} payload:`, payload);
});
