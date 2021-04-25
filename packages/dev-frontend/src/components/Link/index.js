import { NavLink as RouterLink } from "react-router-dom";
import { NavLink as ThemeUINavLink } from "theme-ui";

const ExactLink = props => {
  return <RouterLink exact {...props} />;
};

const CustomLink = ({ children, href, activeClassName, to, ...rest }) => {
  if (href)
    return (
      <a href={href} {...rest} target="_blank" rel="noreferrer">
        {children}
      </a>
    );

  return (
    <RouterLink exact activeClassName={activeClassName} to={to} {...rest}>
      {children}
    </RouterLink>
  );
};

export const Link = props => {
  return <ThemeUINavLink {...props} as={ExactLink} />;
};

export default CustomLink;
