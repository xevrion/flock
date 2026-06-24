import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { FlockProvider } from "../src/provider.js";
import { startMockServer, type MockServer } from "./mock-server.js";

let server: MockServer;

beforeEach(async () => {
  server = await startMockServer();
});

afterEach(async () => {
  cleanup();
  await server.close();
});

describe("FlockProvider", () => {
  it("renders its children without errors", () => {
    render(
      <FlockProvider serverUrl={server.url} roomId="r" userId="me">
        <div>hello</div>
      </FlockProvider>,
    );
    expect(screen.getByText("hello")).toBeDefined();
  });
});
