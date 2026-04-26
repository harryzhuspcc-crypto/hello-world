import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("tank-fight", "routes/tank-fight.tsx"),
  route("super-mario", "routes/super-mario.tsx"),
  route("sky-ace-infinite", "routes/sky-ace-infinite.tsx"),
] satisfies RouteConfig;
