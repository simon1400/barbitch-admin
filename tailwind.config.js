/** @type {import('tailwindcss').Config} */

import { alpha, palette } from './src/ui/palette.js'

// ⚠️ primary/accent (var(--primary)/var(--accent)) НЕ удалять: они ещё используются
// календарём и логином, которые на токены пока не переведены. Семантические токены
// из palette.js живут рядом; слияние — отдельным заходом.
const mainPalette = {
  accent: 'var(--accent)',
  primary: 'var(--primary)',
}

export default {
  darkMode: ['class'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  typography: {
    DEFAULT: {
      css: {
        fontDisplay: 'swap',
      },
    },
  },
  theme: {
    extend: {
      screens: {
        xs: '430px',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        ...mainPalette,
        ...palette,
      },
      fontSize: {
        xss: [
          '13px',
          {
            lineHeight: '19px',
            fontWeight: '800',
          },
        ],
        xs1: [
          '14px',
          {
            lineHeight: '24px',
            fontWeight: '500',
          },
        ],
        xs: [
          '15px',
          {
            lineHeight: '21px',
            fontWeight: '800',
          },
        ],
        sm: [
          '16px',
          {
            lineHeight: '23px',
            fontWeight: '800',
          },
        ],
        baseSm: [
          '16px',
          {
            lineHeight: '30px',
            fontWeight: '500',
          },
        ],
        book: [
          '14px',
          {
            lineHeight: '17px',
            fontWeight: '500',
          },
        ],
        resXxs: [
          '10px',
          {
            lineHeight: '13px',
            fontWeight: '800',
          },
        ],
        resXs: [
          '12px',
          {
            lineHeight: '15px',
            fontWeight: '800',
          },
        ],
        resSm: [
          '13px',
          {
            lineHeight: '24px',
            fontWeight: '800',
          },
        ],
        resMd: [
          '15px',
          {
            lineHeight: '16px',
            fontWeight: '800',
          },
        ],
        resMd1: [
          '16px',
          {
            lineHeight: '17px',
            fontWeight: '800',
          },
        ],
        resLg: [
          '20px',
          {
            lineHeight: '20px',
            fontWeight: '800',
          },
        ],
        resBig: [
          '30px',
          {
            lineHeight: '31px',
            fontWeight: '800',
          },
        ],
        resTop: [
          '35px',
          {
            lineHeight: '36px',
            fontWeight: '800',
          },
        ],
        sm11: [
          '20px',
          {
            lineHeight: '20px',
            fontWeight: '300',
          },
        ],
        baseText: [
          '20px',
          {
            lineHeight: '39px',
            fontWeight: '500',
          },
        ],
        h5: [
          '23px',
          {
            lineHeight: '24px',
            fontWeight: '800',
          },
        ],
        sm1: [
          '25px',
          {
            lineHeight: '35px',
            fontWeight: '800',
          },
        ],
        base: [
          '26px',
          {
            lineHeight: '45px',
            fontWeight: '500',
          },
        ],
        md: [
          '32px',
          {
            lineHeight: '45px',
            fontWeight: '800',
          },
        ],
        md1: [
          '34px',
          {
            lineHeight: '35px',
            fontWeight: '800',
          },
        ],
        md2: [
          '44px',
          {
            lineHeight: '37px',
            fontWeight: '800',
          },
        ],
        lg: [
          '62px',
          {
            lineHeight: '87px',
            fontWeight: '800',
          },
        ],
        xl: [
          '71px',
          {
            lineHeight: '100px',
            fontWeight: '800',
          },
        ],
        xxl: [
          '55px',
          {
            lineHeight: '56px',
            fontWeight: '800',
          },
        ],
        big: [
          '91px',
          {
            lineHeight: '93px',
            fontWeight: '800',
          },
        ],
        top: [
          '127px',
          {
            lineHeight: '115px',
            fontWeight: '800',
          },
        ],
      },
      boxShadow: {
        'default-level1': '0 4px 8px #000',
        'default-level2': '0 4px 16px #000',
        'default-level3': '0 8px 24px #000',
        'default-level4': '0 24px 40px #000',
        // Тени редизайна (s166): строятся из палитры, поэтому смена бренд-цвета
        // перекрашивает и свечение кнопок/фокуса.
        //
        // ⚠️ Имя тени НЕ должно совпадать с именем цвета (`brand`, `card`, `line`…):
        // Tailwind тогда генерит на тот же класс ещё и shadow-COLOR утилиту, она идёт
        // позже в CSS и затирает саму тень (`--tw-shadow: var(--tw-shadow-colored)`).
        panel: `0 1px 2px ${alpha(palette.ink, 0.04)}`, //  карточка-секция
        'panel-lg': `0 8px 30px ${alpha(palette.ink, 0.08)}`, // карточка логина
        pop: `0 10px 28px ${alpha(palette.ink, 0.14)}`, //  дропдаун/поповер
        'brand-sm': `0 3px 10px ${alpha(palette.brand, 0.25)}`, //  розовая кнопка
        'brand-pill': `0 3px 10px ${alpha(palette.brand, 0.28)}`, // активная пилюля шапки
        'brand-lg': `0 4px 12px ${alpha(palette.brand, 0.25)}`, //  крупная розовая кнопка
        focus: `0 0 0 3px ${alpha(palette.brand, 0.1)}`, //  focus-ring инпута
        knob: '0 1px 2px rgba(0,0,0,0.2)', //                ручка тумблера
      },
      spacing: {
        '0': '0px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '7.5': '30px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '11': '43px',
        '13': '50px',
        '15': '60px',
        '17': '70px',
        '18': '77px',
        '20': '85px',
        '23': '94px',
        '27': '108px',
        '33': '132px',
        '50': '200px',
        '0.5': '2px',
        '1.5': '6px',
        '2.5': '10px',
        '3.5': '13.5px',
        '4.5': '18px',
        '5.5': '22px',
        '6.5': '26px',
        '11.5': '45px',
        '13.5': '52px',
        '14.5': '56px',
        '15.2': '62px',
        '16.5': '67px',
        '17.5': '74px',
      },
      backgroundImage: {
        base: "url('/assets/background.jpg')",
      },
      borderRadius: {
        default: '2px',
        'special-small': '5px',
        special: '20px',
        rounded: '100%',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        // Логин: тряска карточки при ошибке входа + появление плашки ошибки.
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-5px)' },
          '40%,80%': { transform: 'translateX(5px)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shake: 'shake 0.35s ease',
        'fade-up': 'fade-up 0.25s ease',
      },
    },
  },
  plugins: [],
}
