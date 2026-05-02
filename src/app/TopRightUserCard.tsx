import { getServerSession } from "next-auth";
import { cookies } from "next/headers";

import { authOptions } from "@/lib/auth";
import { INVITE_SESSION_COOKIE_NAME, verifyInviteSessionToken } from "@/lib/inviteSession";
import { prisma } from "@/lib/prisma";
import TopRightUserMenu from "./TopRightUserMenu";

type CardData = {
  source: "oauth" | "invite";
  nickname: string;
  wkUsername: string;
  email: string | null;
};

async function getOauthCardData(): Promise<CardData | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase() ?? null;
  if (!email) {
    return null;
  }

  const account = await prisma.account.findFirst({
    where: { joinedByEmail: email },
    select: {
      nickname: true,
      wkUsername: true,
      joinedByEmail: true,
    },
  });

  if (account?.wkUsername) {
    return {
      source: "oauth",
      nickname: account.nickname,
      wkUsername: account.wkUsername,
      email,
    };
  }

  const fallbackName = session?.user?.name?.trim() || email.split("@")[0] || "Signed in";
  return {
    source: "oauth",
    nickname: fallbackName,
    wkUsername: "",
    email,
  };
}

async function getInviteCardData(): Promise<CardData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(INVITE_SESSION_COOKIE_NAME)?.value ?? null;
  if (!token) {
    return null;
  }

  const payload = verifyInviteSessionToken(token);
  if (!payload?.accountId) {
    return null;
  }

  const account = await prisma.account.findUnique({
    where: { id: payload.accountId },
    select: {
      nickname: true,
      wkUsername: true,
      joinedByEmail: true,
      inviteCodeHash: true,
    },
  });

  if (!account?.wkUsername || !account.inviteCodeHash) {
    return null;
  }

  return {
    source: "invite",
    nickname: account.nickname,
    wkUsername: account.wkUsername,
    email: account.joinedByEmail,
  };
}

export default async function TopRightUserCard() {
  const oauthCard = await getOauthCardData();
  const inviteCard = oauthCard ? null : await getInviteCardData();
  const card = oauthCard ?? inviteCard;

  if (!card) {
    return null;
  }

  return <TopRightUserMenu card={card} />;
}
