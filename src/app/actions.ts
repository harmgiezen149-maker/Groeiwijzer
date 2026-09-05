'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { assertMember } from '@/lib/garden';
import { ACTIVE_GARDEN_COOKIE, requireUser } from '@/lib/session';

export async function switchGarden(formData: FormData) {
  const gardenId = String(formData.get('gardenId') ?? '');
  const user = await requireUser();
  await assertMember(user.id, gardenId); // cookie wordt nooit blind gevolgd
  const jar = await cookies();
  jar.set(ACTIVE_GARDEN_COOKIE, gardenId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signOutAction() {
  await signOut({ redirectTo: '/login' });
}
