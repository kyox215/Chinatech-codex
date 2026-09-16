import { describe, expect, it } from "vitest";
import {
  createCustomer,
  deleteCustomerDevice,
  getCustomerDetail,
  setCustomerTags,
  updateCustomer,
  upsertCustomerDevice,
} from "./mock-api";

describe("customer mock version contract", () => {
  it("two clients viewing the same version cannot overwrite one another", async () => {
    const created = await createCustomer({ name: "CAS fixture", phone_e164: "+390000998801" });
    const a = await getCustomerDetail(created.id);
    const b = await getCustomerDetail(created.id);
    const input = {
      name: "Client A",
      phone_e164: a.customer.phone_e164,
      expected_updated_at: a.customer.updated_at!,
    };
    const saved = await updateCustomer(created.id, input);
    expect(saved.updated_at).not.toBe(input.expected_updated_at);
    await expect(
      updateCustomer(created.id, {
        ...input,
        name: "Client B",
        expected_updated_at: b.customer.updated_at!,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await getCustomerDetail(created.id)).customer.name).toBe("Client A");
    expect(a.customer.name).toBe("CAS fixture");
  });
  it("stale device updates/deletion and foreign-customer updates leave the device intact", async () => {
    const customer = await createCustomer({ name: "Device fixture", phone_e164: "+390000998802" });
    const device = await upsertCustomerDevice(customer.id, { brand: "Test", model: "A" });
    const edited = await upsertCustomerDevice(customer.id, {
      id: device.id,
      brand: "Test",
      model: "B",
      expected_updated_at: device.updated_at,
    });
    await expect(
      deleteCustomerDevice(customer.id, device.id, device.updated_at),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      upsertCustomerDevice(customer.id, {
        id: device.id,
        brand: "Test",
        model: "C",
        expected_updated_at: device.updated_at,
      }),
    ).rejects.toMatchObject({ status: 409 });
    const other = await createCustomer({ name: "Other fixture", phone_e164: "+390000998803" });
    await expect(
      upsertCustomerDevice(other.id, {
        id: device.id,
        brand: "Test",
        model: "Wrong",
        expected_updated_at: edited.updated_at,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect((await getCustomerDetail(customer.id)).devices[0].model).toBe("B");
    await deleteCustomerDevice(customer.id, device.id, edited.updated_at);
    expect((await getCustomerDetail(customer.id)).devices).toHaveLength(0);
  });
  it("invalid tag input preserves tags/version and stale tag updates conflict", async () => {
    const customer = await createCustomer({ name: "Tag fixture", phone_e164: "+390000998804" });
    const before = await getCustomerDetail(customer.id);
    const first = await setCustomerTags(customer.id, {
      tagIds: ["tag_vip", "tag_vip"],
      expected_customer_updated_at: before.customer.updated_at!,
    });
    expect((await getCustomerDetail(customer.id)).tags).toHaveLength(1);
    await expect(
      setCustomerTags(customer.id, {
        tagIds: [],
        expected_customer_updated_at: before.customer.updated_at!,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      setCustomerTags(customer.id, {
        tagIds: ["foreign-tag"],
        expected_customer_updated_at: first.updated_at,
      }),
    ).rejects.toMatchObject({ status: 400 });
    const after = await getCustomerDetail(customer.id);
    expect(after.customer.updated_at).toBe(first.updated_at);
    expect(after.tags.map((tag) => tag.id)).toEqual(["tag_vip"]);
    await setCustomerTags(customer.id, {
      tagIds: [],
      expected_customer_updated_at: after.customer.updated_at!,
    });
    expect((await getCustomerDetail(customer.id)).tags).toHaveLength(0);
  });
});
