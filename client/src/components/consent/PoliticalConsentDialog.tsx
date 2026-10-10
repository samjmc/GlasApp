/**
 * The consent text a user agrees to before any political answer is stored (GDPR Art. 9(2)(a)).
 * Changing this text means bumping POLITICAL_CONSENT_VERSION in shared/consent.ts, so everyone
 * is asked again.
 */
import { Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  saving: boolean;
  onAgree: () => void;
  onDecline: () => void;
}

export function PoliticalConsentDialog({ open, saving, onAgree, onDecline }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !saving && onDecline()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save your political answers?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Your quiz answers, daily votes and pledge priorities show your political opinions. The law treats
                these as special data, so we store them only if you agree.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>We use them to build your profile and your matches with TDs and parties.</li>
                <li>We may include them in totals that never show any one person.</li>
                <li>We never sell them or show them to other users.</li>
                <li>
                  You can take this back at any time in your profile. That deletes these answers and keeps your
                  account.
                </li>
              </ul>
              <p>
                You can still take the quiz without agreeing; your result is then not saved. See the{" "}
                <Link href="/privacy-policy" className="underline">
                  privacy policy
                </Link>
                .
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Not now</AlertDialogCancel>
          <AlertDialogAction
            disabled={saving}
            onClick={(event) => {
              // Stay open until the consent is saved.
              event.preventDefault();
              onAgree();
            }}
          >
            {saving ? "Saving…" : "I agree"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
