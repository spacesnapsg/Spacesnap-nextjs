type RoleUser = {
  isSupplier?: boolean | null;
  isSystemAdmin?: boolean | null;
};

export function getRoleHome(user: RoleUser): string {
  if (user.isSystemAdmin) return "/admin/dashboard";
  if (user.isSupplier) return "/supplier";
  return "/user";
}
