import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { LECTURE_BOOKS_BUCKET, lectureBookPath } from "@/lib/workstation/lecture-books";

/** How long a signed link to a lecture's book pages stays valid. */
const LINK_SECONDS = 60 * 60;

/** Opens the lecture book pages for one of the signed-in user's lectures. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/work-station/book/[topicId]">) {
  const { topicId } = await ctx.params;
  if (!z.uuid().safeParse(topicId).success) return notFound();
  const user = await requireUser();
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, subject: { plan: { userId: user.id } } },
    select: { title: true },
  });
  const path = topic ? lectureBookPath(topic.title) : null;
  if (!path) return notFound();

  const supabase = createAdminClient();
  if (!supabase) return unavailable();
  const { data, error } = await supabase.storage
    .from(LECTURE_BOOKS_BUCKET)
    .createSignedUrl(path, LINK_SECONDS);
  if (error || !data) return unavailable();
  redirect(data.signedUrl);
}

function notFound() {
  return new Response("No lecture book for this lecture.", { status: 404 });
}

function unavailable() {
  return new Response("The lecture book is not available right now.", { status: 503 });
}
