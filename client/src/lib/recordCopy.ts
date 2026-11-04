/**
 * The words the debate and question records put on an item or a figure. Pure, so each copy branch
 * is tested (components/DebateRecord.tsx, components/QuestionRecord.tsx).
 */
import type { DebateItemView, TdQuestionRecord } from '@shared/parliamentApi';

const CLAIM_LABELS: Record<NonNullable<DebateItemView['claimType']>, string> = {
  figure: 'figure',
  named_source: 'named source',
  cost: 'cost',
  date: 'date',
};

const REPLY_NO_POINTS: Record<NonNullable<DebateItemView['replyNoPoints']>, string> = {
  same_party: ' (same party, no points)',
  closing_speech: ' (closing speech, no points)',
  conceded: ' (scored as a concession)',
};

/** An item's label, from the speaker's side or from the side of the member it was made to. */
export function itemLabel(item: DebateItemView, perspective: 'speaker' | 'target'): string {
  switch (item.kind) {
    case 'specific_claim':
      return item.claimType ? `Claim · ${CLAIM_LABELS[item.claimType]}` : 'Claim';
    case 'concession':
      return perspective === 'target'
        ? `${item.speaker} conceded${item.crossesHouse ? '' : ' (same side, no points)'}`
        : `Concession to ${item.to ?? 'another speaker'}${item.crossesHouse ? '' : ' (same side)'}`;
    case 'response': {
      const noPoints = item.replyNoPoints ? REPLY_NO_POINTS[item.replyNoPoints] : '';
      return perspective === 'target' ? `${item.speaker} took up their point${noPoints}` : `Reply to ${item.to ?? 'another speaker'}${noPoints}`;
    }
    case 'question':
      return item.addressee ? `Question to ${item.addressee}` : 'Question';
    case 'commitment':
      return item.due ? `Promise · ${item.due}` : 'Promise';
  }
}

/** Only a question from the other side of the House can secure a commitment. */
export function securedText(f: TdQuestionRecord['formats'][number]): string {
  if (f.askedAcross === 0) return 'all from the government side, where commitments are not counted';
  const of = f.askedAcross < f.asked ? ` of the ${f.askedAcross} asked across the House` : '';
  return `a specific commitment secured in ${f.securedExchanges}${of}`;
}
