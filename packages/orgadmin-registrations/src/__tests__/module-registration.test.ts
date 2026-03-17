import { describe, it, expect, beforeAll } from "vitest";

let registrationsModule: any;

describe("Registrations Module Registration Configuration", () => {
  beforeAll(async () => {
    const mod = await import("../module.config");
    registrationsModule = mod.registrationsModule;
  });

  describe("Sub-menu items", () => {
    it("should contain 3 sub-menu entries", () => {
      expect(registrationsModule.subMenuItems).toBeDefined();
      expect(registrationsModule.subMenuItems).toHaveLength(3);
    });

    it("should have Discounts sub-menu item with registration-discounts capability", () => {
      const discountsItem = registrationsModule.subMenuItems?.find(
        (item: any) => item.path === "/registrations/discounts"
      );
      expect(discountsItem).toBeDefined();
      expect(discountsItem?.capability).toBe("registration-discounts");
      expect(discountsItem?.label).toBe("modules.registrations.menu.discounts");
    });
  });

  describe("Discount routes", () => {
    it("should gate all discount routes with registration-discounts capability", () => {
      const discountRoutes = registrationsModule.routes.filter((route: any) =>
        route.path.includes("discounts")
      );
      expect(discountRoutes.length).toBe(3);
      discountRoutes.forEach((route: any) => {
        expect(route.capability).toBe("registration-discounts");
      });
    });
  });

  describe("Total routes", () => {
    it("should register 10 routes total", () => {
      expect(registrationsModule.routes).toHaveLength(10);
    });
  });
});
