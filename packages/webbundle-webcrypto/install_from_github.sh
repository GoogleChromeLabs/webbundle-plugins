cd node_modules/.deno
git clone "$1"
cd ..
ln -s  "`pwd`/.deno/$2" "`pwd`"
