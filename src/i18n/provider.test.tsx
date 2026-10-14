import { render, screen } from "@testing-library/react";
import { getDictionary } from "./server";
import { I18nProvider, useDictionary } from "./provider";

function DictionaryProbe() {
  const { dictionary } = useDictionary();

  return <p>{dictionary.auth.signIn}</p>;
}

it("provides the selected Russian dictionary to client components", () => {
  render(
    <I18nProvider locale="ru" dictionary={getDictionary("ru")}>
      <DictionaryProbe />
    </I18nProvider>,
  );

  expect(screen.getByText("Войти")).toBeInTheDocument();
});
