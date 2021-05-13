import { NavLink as RouterLink } from "react-router-dom";

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

export default CustomLink;
