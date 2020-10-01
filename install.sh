#!/bin/sh
reset="\033[0m"
red="\033[31m"
green="\033[32m"
yellow="\033[33m"
cyan="\033[36m"
white="\033[37m"

# other stuff

printf "\n$cyan Installing Amplify!$reset\n\n"

TARBALL_URL=https://sapp.amazon.com/native-cli-testing/amplify.tar.gz

# Dowload binary
BINARY_DIR_PATH=$HOME/.amplify/bin
BINARY_PATH=$BINARY_DIR_PATH/amplify
TEMP_PATH=/tmp/amplify.tar.gz
mkdir -p $BINARY_DIR_PATH
printf "$cyan Downloading Amplify CLI binary...\n$reset"

# curl -L -o $BINARY_PATH $TARBALL_URL
curl -k --anyauth --location-trusted -u: -c /tmp/sapp_cookies.txt -b /tmp/sapp_cookies.txt -o $TEMP_PATH $TARBALL_URL

# untar to binary path
tar xzf $TEMP_PATH -C $BINARY_DIR_PATH
chmod +x $BINARY_PATH

# Ensure aliases
ln -sf amplify $BINARY_DIR_PATH/amp-pkg

# Add to $PATH
SOURCE_STR="# Added by amplify binary installer\nexport PATH=\"\$HOME/.amplify/bin:\$PATH\"\n"
add_to_path () {
  command printf "\n$SOURCE_STR" >> "$1"
  printf "\n$yellow Added the following to $1:\n\n$SOURCE_STR$reset"
}
SHELLTYPE="$(basename "/$SHELL")"
if [[ $SHELLTYPE = "fish" ]]; then
  command fish -c 'set -U fish_user_paths $fish_user_paths ~/.amplify/bin'
  printf "\n$yellow Added ~/.amplify/bin to fish_user_paths universal variable$reset."
elif [[ $SHELLTYPE = "zsh" ]]; then
  SHELL_CONFIG=$HOME/.zshrc
  if [ ! -r $SHELL_CONFIG ] || (! `grep -q '.amplify/bin' $SHELL_CONFIG`); then
    add_to_path $SHELL_CONFIG
  fi
else
  SHELL_CONFIG=$HOME/.bashrc
  if [ ! -r $SHELL_CONFIG ] || (! `grep -q '.amplify/bin' $SHELL_CONFIG`); then
    add_to_path $SHELL_CONFIG
  fi
  SHELL_CONFIG=$HOME/.bash_profile
  if [[ -r $SHELL_CONFIG ]]; then
    if [[ ! $(grep -q '.amplify/bin' $SHELL_CONFIG) ]]; then
      add_to_path $SHELL_CONFIG
    fi
  else
    SHELL_CONFIG=$HOME/.bash_login
    if [[ -r $SHELL_CONFIG ]]; then
      if [[ ! $(grep -q '.amplify/bin' $SHELL_CONFIG) ]]; then
        add_to_path $SHELL_CONFIG
      fi
    else
      SHELL_CONFIG=$HOME/.profile
      if [ ! -r $SHELL_CONFIG ] || (! `grep -q '.amplify/bin' $SHELL_CONFIG`); then
        add_to_path $SHELL_CONFIG
      fi
    fi
  fi
fi

$HOME/.amplify/bin/amplify
echo "Amplify CLI installed as amp-pkg"