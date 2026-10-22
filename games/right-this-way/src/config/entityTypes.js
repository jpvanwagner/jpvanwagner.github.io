/*
 * The three kinds of people from the design sketch legend:
 *   orange dot = Guest (visitor), green dot = Employee, hollow black = Officer.
 * `code` is the single-letter shorthand used for arrival groups ("EG", "OO"...).
 */

export const PersonType = Object.freeze({
  GUEST: {
    id: 'GUEST',
    code: 'G',
    label: 'Visitor',
    color: 0xe28743,
    css: 'var(--c-guest)',
    hasBadge: false,
    canEscort: false,
  },
  EMPLOYEE: {
    id: 'EMPLOYEE',
    code: 'E',
    label: 'Employee',
    color: 0x6fae45,
    css: 'var(--c-employee)',
    hasBadge: true,
    canEscort: true,
  },
  OFFICER: {
    id: 'OFFICER',
    code: 'O',
    label: 'Officer',
    color: 0x1f2937,
    css: 'var(--c-officer)',
    hasBadge: true,
    canEscort: true,
  },
});

export const typeFromCode = (code) =>
  Object.values(PersonType).find((t) => t.code === code);

export const isGuest = (p) => p.type === PersonType.GUEST;
export const isStaff = (p) => p.type !== PersonType.GUEST;
