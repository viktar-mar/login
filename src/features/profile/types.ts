export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileActionState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      code: "validation" | "unauthorized" | "unexpected";
      fieldErrors?: { displayName?: string[]; avatarUrl?: string[] };
    };
