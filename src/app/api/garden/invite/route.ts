import { z } from 'zod';
import { withGarden, readJson } from '@/lib/api';
import { createInvite } from '@/lib/garden';
import { appUrl, button, escapeHtml, mailLayout, sendMail } from '@/lib/mail';
import { parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';

const inviteInput = z.object({ email: z.email('Vul een geldig e-mailadres in') });

export const POST = withGarden(async (ctx, req) => {
  const { email } = parseOrThrow(inviteInput, await readJson(req));
  const invite = await createInvite(ctx.garden.id, email, ctx.user.id);
  const link = appUrl(`/uitnodiging/${invite.token}`);
  const uitnodiger = ctx.user.name ?? ctx.user.email;

  const result = await sendMail({
    to: [invite.email],
    subject: `${uitnodiger} nodigt je uit voor ${ctx.garden.name}`,
    text: `${uitnodiger} nodigt je uit om mee te doen aan de tuin "${ctx.garden.name}" in Bloeiwijzer.\n\n${link}\n\nDe link is 14 dagen geldig.`,
    html: mailLayout(
      `Meedoen aan ${escapeHtml(ctx.garden.name)}`,
      `<p style="margin:0;line-height:1.5;">${escapeHtml(uitnodiger)} nodigt je uit om mee te doen aan deze tuin. Je ziet dezelfde planten en agenda, en kunt taken afvinken.</p>
       ${button(link, 'Uitnodiging aannemen')}
       <p style="margin:0;font-size:13px;color:#5b6b60;">De link is 14 dagen geldig.</p>`,
    ),
  });

  // Zonder mailsleutel geven we de link terug zodat hij handmatig gedeeld kan worden.
  return { invite: { email: invite.email, expiresAt: invite.expiresAt }, link, mail: result };
});
