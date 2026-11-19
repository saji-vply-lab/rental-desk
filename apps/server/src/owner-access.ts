import type { FastifyRequest, FastifyReply } from "fastify";
export function ownerAccess(demo: boolean) {
  const openDemo =
    demo &&
    !process.env.RENTALDESK_OWNER_KEY &&
    !process.env.RENTALDESK_INVENTORY_STAFF_KEY;
  return async function authorize(req: FastifyRequest, reply: FastifyReply) {
    const owner = process.env.RENTALDESK_OWNER_KEY;
    if (
      !openDemo &&
      (!owner || req.headers.authorization !== "Bearer " + owner)
    )
      return reply.code(403).send({
        message: "Enter the owner access key to open customer records.",
      });
  };
}
