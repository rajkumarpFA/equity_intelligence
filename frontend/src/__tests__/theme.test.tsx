import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/common/ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("cycles through themes (system -> dark -> light -> system)", () => {
    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: /theme:/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent(/system/i);

    // Click 1: system -> dark
    fireEvent.click(button);
    expect(button).toHaveTextContent(/dark/i);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("color-scheme")).toBe("dark");

    // Click 2: dark -> light
    fireEvent.click(button);
    expect(button).toHaveTextContent(/light/i);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("color-scheme")).toBe("light");

    // Click 3: light -> system
    fireEvent.click(button);
    expect(button).toHaveTextContent(/system/i);
    expect(localStorage.getItem("color-scheme")).toBeNull();
  });
});
