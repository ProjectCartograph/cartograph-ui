{
  description = "Cartograph interfaces: one pinned toolchain on x86_64 and aarch64";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forEachSystem = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forEachSystem (pkgs:
        let haveChromium = pkgs.stdenv.hostPlatform.isLinux; in {
          default = pkgs.mkShell {
            name = "cartograph-ui";
            packages = with pkgs; [ nodejs_24 just bashInteractive coreutils gnugrep gnused curl git gnutar gzip ]
              ++ pkgs.lib.optionals haveChromium [ chromium ];
            shellHook = ''
              ${pkgs.lib.optionalString haveChromium ''export CHROMIUM="${pkgs.chromium}/bin/chromium"''}
              export CARTOGRAPH_TOOLCHAIN=1
            '';
          };
        });
      formatter = forEachSystem (pkgs: pkgs.nixpkgs-fmt);
    };
}
