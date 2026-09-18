import type { Role, TrainerStatus } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Lowercased wallet address. */
      address: string;
      role: Role;
      trainerStatus?: TrainerStatus;
    } & DefaultSession["user"];
  }

  interface User {
    address: string;
    role: Role;
    trainerStatus: TrainerStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    address: string;
    role: Role;
    trainerStatus?: TrainerStatus;
  }
}

export {};
