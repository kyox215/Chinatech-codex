export type LoginDevice = {
  id: string; browser: string; os: string; createdAt: string; lastActiveAt: string;
  remember: boolean; current: boolean; revoked: boolean; revision: number;
};
export type LoginDevices = { accountId: string; sessionId: string; actionableCount: number; devices: LoginDevice[]; nextOffset: number | null };
