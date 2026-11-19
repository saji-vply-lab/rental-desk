let ownerKey = "";
export const headers = () => ({
  "Content-Type": "application/json",
  Authorization: "Bearer " + ownerKey,
});
export function setOwnerKey(value: string) {
  ownerKey = value;
}
