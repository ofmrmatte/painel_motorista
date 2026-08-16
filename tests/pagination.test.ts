import { describe, expect, it } from "vitest";
import { readPaged } from "@/lib/pagination";

describe("paginacao do portal", () => {
  it("carrega historico acima do tamanho de pagina sem truncar", async () => {
    const rows = Array.from({ length: 1250 }, (_, id) => ({ id }));
    const result = await readPaged(async (offset, size) => ({
      rows: rows.slice(offset, offset + size),
      count: rows.length,
    }), 500);
    expect(result).toHaveLength(1250);
  });

  it("falha quando a carga fica menor que a contagem do banco", async () => {
    await expect(readPaged(async (offset, size) => ({
      rows: offset === 0 ? Array.from({ length: size }, (_, id) => ({ id })) : [],
      count: 501,
    }), 500)).rejects.toThrow("Divergencia de paginacao");
  });
});

