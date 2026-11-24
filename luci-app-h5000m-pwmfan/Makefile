include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-h5000m-pwmfan
PKG_VERSION:=5.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=H5000M PWM Fan contributors

LUCI_TITLE:=H5000M PWM fan control
LUCI_DEPENDS:=+luci-base +kmod-hwmon-pwmfan
LUCI_PKGARCH:=all

define Package/luci-app-h5000m-pwmfan/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || { /etc/init.d/h5000m-pwmfan enable; /etc/init.d/h5000m-pwmfan start; }
exit 0
endef

define Package/luci-app-h5000m-pwmfan/conffiles
/etc/config/h5000m_pwmfan
endef

include $(TOPDIR)/feeds/luci/luci.mk
# call BuildPackage - OpenWrt buildroot signature
