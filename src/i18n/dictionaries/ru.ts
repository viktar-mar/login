import type { Dictionary } from "../types";

export const ru = {
  home: {
    productName: "Название вашего продукта",
    description:
      "Начните с безопасной, готовой к повторному использованию основы аутентификации.",
  },
  navigation: {
    home: "Главная",
    dashboard: "Панель управления",
    profile: "Профиль",
    signOut: "Выйти",
  },
  auth: {
    signIn: "Войти",
    signUp: "Зарегистрироваться",
    email: "Адрес электронной почты",
    password: "Пароль",
    confirmPassword: "Подтвердите пароль",
    forgotPassword: "Забыли пароль?",
    newPassword: "Новый пароль",
    rememberMe: "Запомнить меня",
    noAccount: "Нет аккаунта?",
    haveAccount: "Уже есть аккаунт?",
    sendRecoveryLink: "Отправить ссылку для восстановления",
    updatePassword: "Обновить пароль",
    showPassword: "Показать пароль",
    hidePassword: "Скрыть пароль",
  },
  signup: {
    title: "Создайте аккаунт",
    submit: "Создать аккаунт",
    checkEmail: "Проверьте почту, чтобы подтвердить аккаунт.",
  },
  emailConfirmation: {
    title: "Подтвердите электронную почту",
    message: "Проверьте входящие и перейдите по ссылке подтверждения.",
    success: "Почта подтверждена. Войдите с вашим паролем.",
  },
  passwordRecovery: {
    title: "Восстановите пароль",
    message:
      "Введите адрес электронной почты, и мы отправим ссылку для восстановления.",
    success: "Если аккаунт существует, ссылка для восстановления отправлена.",
  },
  passwordUpdate: {
    title: "Установите новый пароль",
    success: "Ваш пароль обновлён.",
  },
  captcha: {
    loading: "Загрузка проверки безопасности…",
    failed: "Проверка безопасности не пройдена. Попробуйте ещё раз.",
    expired: "Срок проверки истёк. Попробуйте ещё раз.",
    verified: "Проверка безопасности пройдена.",
    retry: "Повторить проверку безопасности",
  },
  oauth: {
    or: "Или",
    continueWith: "Продолжить через",
    google: "Google",
    facebook: "Facebook",
    apple: "Apple",
    github: "GitHub",
    microsoft: "Microsoft",
    discord: "Discord",
  },
  dashboard: {
    title: "Панель управления",
    welcome: "С возвращением",
    signedInAs: "Вы вошли как",
    userId: "ID пользователя",
  },
  profile: {
    title: "Профиль",
    displayName: "Отображаемое имя",
    avatarUrl: "URL аватара",
    save: "Сохранить изменения",
    saved: "Профиль обновлён.",
  },
  validation: {
    reviewFields: "Проверьте выделенные поля и попробуйте ещё раз.",
    emailRequired: "Введите адрес электронной почты.",
    emailInvalid: "Введите корректный адрес электронной почты.",
    passwordRequired: "Введите пароль.",
    passwordMinLength: "Пароль должен содержать не менее 8 символов.",
    passwordMismatch: "Пароли не совпадают.",
    displayNameTooLong: "Отображаемое имя слишком длинное.",
    displayNameRequired: "Введите отображаемое имя.",
    avatarUrlInvalid: "Введите корректный URL аватара.",
  },
  errors: {
    generic: "Что-то пошло не так. Попробуйте ещё раз.",
    invalidCredentials: "Неверный адрес электронной почты или пароль.",
    emailAlreadyRegistered: "Аккаунт с таким адресом уже существует.",
    emailNotConfirmed: "Подтвердите электронную почту перед входом.",
    recoveryLinkInvalid:
      "Эта ссылка для восстановления недействительна или устарела.",
    authLinkInvalid:
      "Эта ссылка для входа или подтверждения недействительна или устарела. Попробуйте ещё раз.",
    unauthorized: "Войдите, чтобы продолжить.",
  },
  theme: {
    label: "Тема",
    light: "Светлая",
    dark: "Тёмная",
    system: "Системная",
  },
  locale: {
    label: "Язык",
    en: "Английский",
    ru: "Русский",
  },
} satisfies Dictionary;
