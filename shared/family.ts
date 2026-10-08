export type FamilyInvite = {
  id: string;
  owner_id: string;
  viewer_id: string | null;
  owner_name: string;
  viewer_name: string | null;
  viewer_email: string | null;
  scope: 'summary' | 'transactions';
  state: 'invited' | 'pending' | 'active' | 'revoked';
  expires_at: string;
  account_id?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  can_propose?: boolean;
};

export type FamilyRelationship = {
  id: string;
  name: string;
  email: string | null;
  sharedByMe: FamilyInvite[];
  sharedWithMe: FamilyInvite[];
};

export function groupFamilyInvites(invites: FamilyInvite[], userId: string): FamilyRelationship[] {
  const groups = new Map<string, FamilyRelationship>();
  for (const invite of invites) {
    const sharedByMe = invite.owner_id === userId;
    const counterpart = sharedByMe ? invite.viewer_id : invite.owner_id;
    const id = counterpart ?? `pending:${invite.id}`;
    let group = groups.get(id);
    if (!group) {
      group = {
        id,
        name: sharedByMe ? invite.viewer_name ?? 'Convite sem destinatário' : invite.owner_name,
        email: sharedByMe ? invite.viewer_email : null,
        sharedByMe: [],
        sharedWithMe: [],
      };
      groups.set(id, group);
    }
    group[sharedByMe ? 'sharedByMe' : 'sharedWithMe'].push(invite);
  }
  return [...groups.values()].sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));
}