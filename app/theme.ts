// Unified Theme Configuration
export const theme = {
  colors: {
    primary: {
      main: 'bg-blue-600',
      hover: 'hover:bg-blue-700',
      text: 'text-blue-600',
      light: 'bg-blue-100',
      textLight: 'text-blue-700',
    },
    secondary: {
      main: 'bg-gray-800',
      hover: 'hover:bg-gray-900',
      text: 'text-gray-800',
      light: 'bg-gray-100',
      textLight: 'text-gray-700',
    },
    background: {
      main: 'bg-white',
      secondary: 'bg-gray-50',
      card: 'bg-white',
    },
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-600',
      muted: 'text-gray-500',
      white: 'text-white',
    },
    border: {
      default: 'border-gray-200',
      light: 'border-gray-100',
    },
    status: {
      success: {
        bg: 'bg-green-100',
        text: 'text-green-700',
      },
      warning: {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
      },
      error: {
        bg: 'bg-red-100',
        text: 'text-red-700',
      },
      info: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
      },
    },
  },
  spacing: {
    container: 'container mx-auto px-4',
    section: 'py-8',
    card: 'p-6',
  },
  shadows: {
    card: 'shadow',
    cardHover: 'shadow-md',
    lg: 'shadow-lg',
  },
  borderRadius: {
    default: 'rounded-lg',
    card: 'rounded-xl',
    full: 'rounded-full',
  },
};

