import { describe, expect, it } from "vitest";
import { shareMessage, whatsappLink } from "@/store/share";

const cart = [{ id: "cooker-hawkins-classic-3", qty: 1 }, { id: "earbuds-boat-141", qty: 2 }];

describe("share with a trusted person", () => {
  it("writes the cart in words with the total from the catalogue", () => {
    expect(shareMessage(cart, "en")).toBe("My Omnikart cart: 1 Hawkins Classic 3 Litre Aluminium Pressure Cooker and 2 boAt Airdopes 141 Bluetooth Earbuds. Total ₹3,473. Please check it before I pay.");
  });
  it("works in Hindi and Telugu", () => {
    expect(shareMessage(cart, "hi")).toContain("₹3,473");
    expect(shareMessage(cart, "te")).toContain("₹3,473");
  });
  it("is a wa.me link with the message encoded", () => {
    const link = whatsappLink(cart, "en");
    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe(shareMessage(cart, "en"));
  });
});
