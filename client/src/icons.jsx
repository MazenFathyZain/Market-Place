import React from 'react';

const paths = {
  ArrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  BookOpen: (
    <>
      <path d="M12 7v14" />
      <path d="M3 18V5a2 2 0 0 1 2-2h3a4 4 0 0 1 4 4 4 4 0 0 1 4-4h3a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-3a4 4 0 0 0-4 1 4 4 0 0 0-4-1H5a2 2 0 0 1-2-2Z" />
    </>
  ),
  Check: <path d="m20 6-11 11-5-5" />,
  LockKeyhole: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  LogOut: (
    <>
      <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M16 8l4 4-4 4M20 12H9" />
    </>
  ),
  ChevronDown: <path d="m6 9 6 6 6-6" />,
  Menu: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </>
  ),
  Minus: <path d="M5 12h14" />,
  Plus: <path d="M12 5v14M5 12h14" />,
  Search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  ShieldCheck: (
    <>
      <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  ShoppingBag: (
    <>
      <path d="M4 8h16l-1 13H5L4 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </>
  ),
  SlidersHorizontal: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="white" />
      <circle cx="16" cy="17" r="2" fill="white" />
    </>
  ),
  Sparkles: (
    <>
      <path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2Z" />
      <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
    </>
  ),
  Trash2: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </>
  ),
  UserRound: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  X: <path d="M5 5l14 14M19 5 5 19" />,
};
const icon = (name) =>
  function Icon({ size = 24, strokeWidth = 2, ...props }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {paths[name]}
      </svg>
    );
  };
export const ArrowLeft = icon('ArrowLeft');
export const BookOpen = icon('BookOpen');
export const Check = icon('Check');
export const LockKeyhole = icon('LockKeyhole');
export const LogOut = icon('LogOut');
export const ChevronDown = icon('ChevronDown');
export const Menu = icon('Menu');
export const Minus = icon('Minus');
export const Plus = icon('Plus');
export const Search = icon('Search');
export const ShieldCheck = icon('ShieldCheck');
export const ShoppingBag = icon('ShoppingBag');
export const SlidersHorizontal = icon('SlidersHorizontal');
export const Sparkles = icon('Sparkles');
export const Trash2 = icon('Trash2');
export const UserRound = icon('UserRound');
export const X = icon('X');
