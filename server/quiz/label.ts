/**
 * A position → a short ideology name and one-paragraph description. Pure, no model call.
 * Ported from the old client-side getMultidimensionalIdeology into the shared sign rule
 * (+ = right-coded pole), which also fixes its globalism branch.
 */
import type { IdeologyVector } from '@shared/ideology';

const STRONG = 6;
const MODERATE = 3;

export interface IdeologyLabel {
  name: string;
  description: string;
}

export function ideologyLabel(v: IdeologyVector): IdeologyLabel {
  const left = -v.economic;
  const right = v.economic;
  const progressive = -(v.social + v.cultural) / 2;
  const conservative = (v.social + v.cultural) / 2;
  const libertarian = -v.authority;
  const authoritarian = v.authority;
  const internationalist = -v.globalism;
  const nationalist = v.globalism;
  const communitarian = -v.welfare;
  const individualist = v.welfare;
  const technocratic = -v.technocratic;
  const populist = v.technocratic;

  if (left > STRONG && authoritarian > STRONG) {
    return {
      name: 'Authoritarian Left',
      description:
        'You favour strong state control of the economy and society to achieve equality and social goals. You believe centralised authority is needed to deliver progressive economic policy.',
    };
  }
  if (right > STRONG && authoritarian > STRONG) {
    return {
      name: 'Authoritarian Right',
      description:
        'You favour traditional values, national identity and strong leadership. You believe a powerful state should protect cultural traditions, keep social order and defend national sovereignty.',
    };
  }
  if (left > MODERATE && libertarian > MODERATE) {
    return {
      name: 'Libertarian Left',
      description:
        'You support economic equality and personal freedom, with cooperative economics and little state control. You value community decision-making, civil liberties and social justice.',
    };
  }
  if (right > MODERATE && libertarian > MODERATE) {
    return {
      name: 'Libertarian Right',
      description:
        'You support free markets and individual liberty with minimal government. You believe in strong property rights, free enterprise and personal freedom in economic and social life.',
    };
  }
  if (left > STRONG && progressive > STRONG) {
    return {
      name: 'Progressive Left',
      description:
        'You favour significant redistribution and progressive social policy. You believe the state should actively reduce inequality and promote social justice.',
    };
  }
  if (right > STRONG && conservative > STRONG) {
    return {
      name: 'Conservative Right',
      description:
        'You support free markets and traditional social values: limited economic intervention, with traditional cultural norms and national identity upheld.',
    };
  }
  if (Math.abs(v.economic) < MODERATE && Math.abs(v.social) < MODERATE) {
    return {
      name: 'Centrist',
      description:
        'You favour moderate, pragmatic approaches that balance competing values. You are sceptical of ideological extremes and prefer evidence-based policy drawn from several traditions.',
    };
  }

  const economic =
    left > STRONG ? 'Socialist'
    : left > MODERATE ? 'Social Democratic'
    : right > STRONG ? 'Free Market'
    : right > MODERATE ? 'Market-Oriented'
    : 'Centrist';
  const social =
    progressive > STRONG ? 'Progressive'
    : progressive > MODERATE ? 'Moderately Progressive'
    : conservative > STRONG ? 'Traditional'
    : conservative > MODERATE ? 'Conservative'
    : 'Socially Moderate';
  const authority =
    libertarian > STRONG ? 'Libertarian'
    : libertarian > MODERATE ? 'Civil Libertarian'
    : authoritarian > STRONG ? 'Authoritarian'
    : authoritarian > MODERATE ? 'Statist'
    : '';
  const global =
    internationalist > STRONG ? 'Internationalist'
    : nationalist > STRONG ? 'Nationalist'
    : nationalist > MODERATE ? 'Patriotic'
    : '';
  const collective = communitarian > STRONG ? 'Communitarian' : individualist > STRONG ? 'Individualist' : '';
  const governance = technocratic > MODERATE ? 'Technocratic' : populist > MODERATE ? 'Populist' : '';

  const prefix = [collective, global, governance, authority].filter(Boolean).join(' ');
  const name = `${prefix} ${economic} ${social}`.trim();
  const parts = [`Your politics combine ${economic.toLowerCase()} economic views with ${social.toLowerCase()} social views.`];
  if (authority) parts.push(`You favour a ${authority.toLowerCase()} approach to government authority.`);
  if (global) parts.push(`On global issues you lean ${global.toLowerCase()}.`);
  if (collective) parts.push(`You value ${collective.toLowerCase()} approaches to social organisation.`);
  if (governance) parts.push(`You prefer ${governance.toLowerCase()} approaches to governance.`);
  return { name, description: parts.join(' ') };
}
