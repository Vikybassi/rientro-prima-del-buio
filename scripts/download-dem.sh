#!/bin/sh
# Scarica le 4 tessere del modello del terreno Copernicus GLO-30 che coprono la Valtellina (~170 MB)
# dall'archivio pubblico su AWS Open Data. Vanno in data-cache/dem/, esclusa da git.
set -e
mkdir -p data-cache/dem
for tile in N45_00_E009 N45_00_E010 N46_00_E009 N46_00_E010; do
  name="Copernicus_DSM_COG_10_${tile}_00_DEM"
  if [ ! -f "data-cache/dem/$name.tif" ]; then
    echo "Scarico $name"
    curl --fail --silent --show-error -o "data-cache/dem/$name.tif" \
      "https://copernicus-dem-30m.s3.amazonaws.com/$name/$name.tif"
  fi
done
echo "Tessere pronte in data-cache/dem/"
