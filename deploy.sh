rm -rf node_modules
npm install --arch=x64 --platform=linux #--target=10.4.1 sharp
rm -f *.zip
# npm uninstall sharp
#npm install --platform=linux --arch=x64 sharp # Change platform of sharp library -> Linux for Mac User

zip -r uploadFileCustomFolderName.zip ./ -x "deploy.sh" -x '*.git*'  # zip project
aws lambda update-function-code \
  --region "ap-southeast-1" \
  --function-name uploadFileCustomFolderName \
  --zip-file fileb://uploadFileCustomFolderName.zip